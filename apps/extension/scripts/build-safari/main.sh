#!/bin/bash
set -uo pipefail

# Resolve paths - main.sh is in scripts/build-safari/, PROJECT_ROOT is apps/extension/
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Source library files
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/ui.sh"
source "$SCRIPT_DIR/helpers.sh"
source "$SCRIPT_DIR/steps.sh"

# =============================================================================
# Argument parsing
# =============================================================================

BUILD_TYPE="dmg"
SIGNED=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dmg)
            BUILD_TYPE="dmg"
            shift
            ;;
        --signed)
            SIGNED=true
            shift
            ;;
        --appstore)
            BUILD_TYPE="appstore"
            SIGNED=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            info "Usage: $0 [--dmg] [--signed] | [--appstore]"
            exit 1
            ;;
    esac
done

# =============================================================================
# Environment setup
# =============================================================================

if [ -f "$PROJECT_ROOT/.env" ]; then
    info "Loading environment from .env file..."
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

# Validate required variables
MISSING_VARS=()
if [ "$SIGNED" = true ]; then
    [ -z "${APPLE_TEAM_ID:-}" ] && MISSING_VARS+=("APPLE_TEAM_ID")
    if [ "$BUILD_TYPE" = "dmg" ]; then
        [ -z "${APPLE_ID:-}" ] && MISSING_VARS+=("APPLE_ID")
        [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] && MISSING_VARS+=("APPLE_APP_SPECIFIC_PASSWORD")
    fi
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}Error: Missing required environment variables:${NC}"
    printf '  - %s\n' "${MISSING_VARS[@]}"
    info "Set them in .env file (copy from .env.example) or export them before running."
    exit 1
fi

# =============================================================================
# Build configuration
# =============================================================================

# Step counts:
# - Unsigned DMG: build, convert, xcode, create DMG = 4
# - Signed DMG: build, convert, xcode, verify, create DMG, notarize, staple = 7
# - App Store: build, convert, xcode, verify, create pkg = 5

if [ "$BUILD_TYPE" = "dmg" ]; then
    OUTPUT_FILE="stream-keys-safari.dmg"
    if [ "$SIGNED" = true ]; then
        CODE_SIGN_IDENTITY="$DEVELOPER_ID_APP"
        TOTAL_STEPS=7
        BUILD_DESCRIPTION="Signed + Notarized DMG"
    else
        CODE_SIGN_IDENTITY="-"
        TOTAL_STEPS=4
        BUILD_DESCRIPTION="Local DMG (unsigned)"
    fi
else
    OUTPUT_FILE="stream-keys-safari-appstore.pkg"
    CODE_SIGN_IDENTITY="$APPLE_DISTRIBUTION"
    TOTAL_STEPS=5
    BUILD_DESCRIPTION="App Store Package"
fi

OUTPUT_PATH="$BUILD_DIR/$OUTPUT_FILE"

# Set up trap after configuration is complete
trap cleanup EXIT

# =============================================================================
# Build process
# =============================================================================

cd "$PROJECT_ROOT"

# Initialize display (TTY gets fixed header, CI gets simple output)
if [ "$IS_TTY" = true ]; then
    init_display
else
    echo -e "${GREEN}=== Building Safari Extension ($BUILD_DESCRIPTION) ===${NC}"
fi

# Step 1: Build Safari extension with Vite
step "Building Safari extension..."
run env BROWSER=safari npx vite build
step_check "Failed to build Safari extension"

# Step 2: Convert to Xcode project
step "Converting to Xcode project..."
run xcrun safari-web-extension-converter "$BUILD_DIR/extension" \
    --project-location "$XCODE_DIR" \
    --app-name "$APP_NAME" \
    --bundle-identifier "$BUNDLE_ID" \
    --force \
    --no-prompt \
    --no-open
step_check "Failed to convert to Xcode project"

# Fix bundle identifier (converter derives from app name, ignoring our setting)
info "Fixing bundle identifiers..."
PBXPROJ="$XCODE_DIR/$APP_NAME/$APP_NAME.xcodeproj/project.pbxproj"
sed -i '' 's/com\.getstreamkeys\.Stream-Keys/com.getstreamkeys.StreamKeys/g' "$PBXPROJ"

# Copy entitlements files to the Xcode project
info "Copying entitlements files..."
cp "$SCRIPT_DIR/entitlements/app.entitlements" "$XCODE_DIR/$APP_NAME/macOS (App)/App.entitlements"
cp "$SCRIPT_DIR/entitlements/extension.entitlements" "$XCODE_DIR/$APP_NAME/macOS (Extension)/Extension.entitlements"

# Configure entitlements in project.pbxproj (use INFOPLIST_FILE as anchor - always present)
info "Configuring entitlements in Xcode project..."
# Add CODE_SIGN_ENTITLEMENTS for macOS App target
sed -i '' 's/INFOPLIST_FILE = "macOS (App)\/Info.plist";/CODE_SIGN_ENTITLEMENTS = "macOS (App)\/App.entitlements";\n\t\t\t\tINFOPLIST_FILE = "macOS (App)\/Info.plist";/g' "$PBXPROJ"
# Add CODE_SIGN_ENTITLEMENTS for macOS Extension target
sed -i '' 's/INFOPLIST_FILE = "macOS (Extension)\/Info.plist";/CODE_SIGN_ENTITLEMENTS = "macOS (Extension)\/Extension.entitlements";\n\t\t\t\tINFOPLIST_FILE = "macOS (Extension)\/Info.plist";/g' "$PBXPROJ"

# Step 3: Build with Xcode
step "Building app with Xcode ($CODE_SIGN_IDENTITY)..."
cd "$XCODE_DIR/$APP_NAME"

if [ "$SIGNED" = true ]; then
    run xcodebuild -scheme "$APP_NAME (macOS)" \
        -configuration Release \
        -derivedDataPath ../DerivedData \
        CODE_SIGN_IDENTITY="$CODE_SIGN_IDENTITY" \
        CODE_SIGN_STYLE=Manual \
        DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
        CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO \
        OTHER_CODE_SIGN_FLAGS='--timestamp --options=runtime'
else
    run xcodebuild -scheme "$APP_NAME (macOS)" \
        -configuration Release \
        -derivedDataPath ../DerivedData \
        CODE_SIGN_IDENTITY="$CODE_SIGN_IDENTITY"
fi
step_check "Failed to build with Xcode"

cd "$PROJECT_ROOT"

# Step 4 (signed only): Verify code signature
if [ "$SIGNED" = true ]; then
    step "Verifying code signature..."

    info "  Checking app signature..."
    codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1

    CODESIGN_INFO=$(codesign -dv --verbose=4 "$APP_PATH" 2>&1)

    info "  Checking signing identity..."
    SIGNING_AUTHORITY=$(echo "$CODESIGN_INFO" | grep "Authority=" | head -1 | sed 's/Authority=//')
    if [[ "$SIGNING_AUTHORITY" == *"$DEVELOPER_NAME"* ]]; then
        success "Signed by $SIGNING_AUTHORITY"
    else
        error "Wrong signing identity: $SIGNING_AUTHORITY (expected $CODE_SIGN_IDENTITY)"
        exit 1
    fi

    info "  Checking for hardened runtime and timestamp..."
    if echo "$CODESIGN_INFO" | grep -q "flags=.*runtime"; then
        success "Hardened runtime enabled"
    else
        error "Hardened runtime not enabled"
        exit 1
    fi
    
    if echo "$CODESIGN_INFO" | grep -q "Timestamp="; then
        success "Secure timestamp present"
    else
        error "Secure timestamp missing"
        exit 1
    fi

    info "  Checking entitlements (no debug entitlement)..."
    ENTITLEMENTS=$(codesign -d --entitlements - "$APP_PATH" 2>&1 || true)
    if echo "$ENTITLEMENTS" | grep -q "get-task-allow"; then
        error "Debug entitlement 'get-task-allow' found - will fail notarization"
        exit 1
    else
        success "No debug entitlement"
    fi

    info "  Checking extension signature..."
    codesign --verify --deep --strict "$EXTENSION_PATH" 2>&1 && success "Extension signature valid"

    success "All signature checks passed!"
    step_check
fi

# =============================================================================
# Package creation
# =============================================================================

if [ "$BUILD_TYPE" = "dmg" ]; then
    step "Creating styled DMG..."
    rm -f "$OUTPUT_PATH"
    run npx appdmg "$SCRIPT_DIR/dmg-config.json" "$OUTPUT_PATH"
    step_check "Failed to create DMG"

    if [ "$SIGNED" = true ]; then
        step "Submitting for notarization..."
        NOTARY_OUTPUT=$(notarytool submit "$OUTPUT_PATH" --wait 2>&1)
        echo "$NOTARY_OUTPUT"
        step_check "Notarization failed"

        SUBMISSION_ID=$(echo "$NOTARY_OUTPUT" | grep -E "^\s*id:" | head -1 | awk '{print $2}')

        step "Stapling notarization ticket..."
        MAX_RETRIES=5
        RETRY_DELAY=15
        info "Waiting ${RETRY_DELAY}s for notarization ticket to propagate..."
        sleep $RETRY_DELAY
        
        for i in $(seq 1 $MAX_RETRIES); do
            if xcrun stapler staple "$OUTPUT_PATH" 2>/dev/null; then
                success "Stapling successful!"
                step_check
                break
            elif [ $i -eq $MAX_RETRIES ]; then
                error "Stapling failed after $MAX_RETRIES attempts."
                if [ -n "$SUBMISSION_ID" ]; then
                    info "Fetching notarization log for submission $SUBMISSION_ID..."
                    notarytool log "$SUBMISSION_ID" 2>&1 || true
                fi
                exit 1
            else
                warn "Stapling failed (attempt $i/$MAX_RETRIES). Waiting ${RETRY_DELAY}s for ticket propagation..."
                sleep $RETRY_DELAY
            fi
        done
    fi

else
    step "Creating signed installer package..."
    cd "$PROJECT_ROOT/$BUILD_DIR"
    
    run productbuild \
        --component "xcode/DerivedData/Build/Products/Release/$APP_NAME.app" /Applications \
        --sign "$INSTALLER_CERT" \
        "$OUTPUT_FILE"
    step_check "Failed to create installer package"
    
    info "Note: App Store packages are not notarized - Apple handles this during review."
fi

# Exit successfully (trap will print summary)
exit 0
