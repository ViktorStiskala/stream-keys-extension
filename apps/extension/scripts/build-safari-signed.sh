#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
BUILD_TYPE="dmg"  # default
while [[ $# -gt 0 ]]; do
    case $1 in
        --dmg)
            BUILD_TYPE="dmg"
            shift
            ;;
        --appstore)
            BUILD_TYPE="appstore"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dmg|--appstore]"
            exit 1
            ;;
    esac
done

# Load .env file if it exists (for local development)
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "Loading environment from .env file..."
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

# Validate required variables
MISSING_VARS=()
[ -z "${APPLE_TEAM_ID:-}" ] && MISSING_VARS+=("APPLE_TEAM_ID")

# Notarization credentials only required for DMG builds
if [ "$BUILD_TYPE" = "dmg" ]; then
    [ -z "${APPLE_ID:-}" ] && MISSING_VARS+=("APPLE_ID")
    [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] && MISSING_VARS+=("APPLE_APP_SPECIFIC_PASSWORD")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "Error: Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Set them in .env file (copy from .env.example) or export them before running."
    exit 1
fi

# Set build-specific variables
if [ "$BUILD_TYPE" = "dmg" ]; then
    CODE_SIGN_IDENTITY="Developer ID Application: Viktor Stískala (D8Z6CRA2WJ)"
    TOTAL_STEPS=7
    BUILD_DESCRIPTION="Signed + Notarized DMG"
    OUTPUT_FILE="stream-keys-safari.dmg"
else
    CODE_SIGN_IDENTITY="Apple Distribution: Viktor Stískala (D8Z6CRA2WJ)"
    TOTAL_STEPS=5
    BUILD_DESCRIPTION="App Store Package"
    OUTPUT_FILE="stream-keys-safari-appstore.pkg"
fi

echo "=== Building Safari Extension ($BUILD_DESCRIPTION) ==="

# Change to project root for consistent paths
cd "$PROJECT_ROOT"

APP_PATH="build/production/safari/xcode/DerivedData/Build/Products/Release/Stream Keys.app"
EXTENSION_PATH="$APP_PATH/Contents/PlugIns/Stream Keys Extension.appex"

# Step 1: Build Safari extension with Vite
echo ""
echo "Step 1/$TOTAL_STEPS: Building Safari extension..."
BROWSER=safari npx vite build

# Step 2: Convert to Xcode project
echo ""
echo "Step 2/$TOTAL_STEPS: Converting to Xcode project..."
xcrun safari-web-extension-converter build/production/safari/extension \
    --project-location build/production/safari/xcode \
    --app-name 'Stream Keys' \
    --bundle-identifier com.getstreamkeys.safari \
    --force \
    --no-prompt \
    --no-open

# Step 3: Build with code signing
echo ""
echo "Step 3/$TOTAL_STEPS: Building and signing app with $CODE_SIGN_IDENTITY..."
cd "build/production/safari/xcode/Stream Keys"
xcodebuild -scheme 'Stream Keys (macOS)' \
    -configuration Release \
    -derivedDataPath ../DerivedData \
    CODE_SIGN_IDENTITY="$CODE_SIGN_IDENTITY" \
    CODE_SIGN_STYLE=Manual \
    DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
    CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO \
    OTHER_CODE_SIGN_FLAGS='--timestamp --options=runtime'

cd "$PROJECT_ROOT"

# Step 4: Verify code signature
echo ""
echo "Step 4/$TOTAL_STEPS: Verifying code signature..."

echo "  Checking app signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1 | head -5

echo "  Checking for hardened runtime and timestamp..."
CODESIGN_INFO=$(codesign -dv --verbose=4 "$APP_PATH" 2>&1)
if echo "$CODESIGN_INFO" | grep -q "flags=.*runtime"; then
    echo "  ✓ Hardened runtime enabled"
else
    echo "  ✗ ERROR: Hardened runtime not enabled"
    exit 1
fi
if echo "$CODESIGN_INFO" | grep -q "Timestamp="; then
    echo "  ✓ Secure timestamp present"
else
    echo "  ✗ ERROR: Secure timestamp missing"
    exit 1
fi

echo "  Checking entitlements (no debug entitlement)..."
ENTITLEMENTS=$(codesign -d --entitlements - "$APP_PATH" 2>&1 || true)
if echo "$ENTITLEMENTS" | grep -q "get-task-allow"; then
    echo "  ✗ ERROR: Debug entitlement 'get-task-allow' found - will fail notarization"
    exit 1
else
    echo "  ✓ No debug entitlement"
fi

echo "  Checking extension signature..."
codesign --verify --deep --strict "$EXTENSION_PATH" 2>&1 && echo "  ✓ Extension signature valid"

echo "  All signature checks passed!"

# Build type specific steps
if [ "$BUILD_TYPE" = "dmg" ]; then
    # DMG build: Create DMG, notarize, staple
    
    # Step 5: Create DMG
    echo ""
    echo "Step 5/$TOTAL_STEPS: Creating DMG..."
    cd "$PROJECT_ROOT/build/production/safari"
    rm -rf dmg-contents
    mkdir -p dmg-contents
    cp -R "xcode/DerivedData/Build/Products/Release/Stream Keys.app" dmg-contents/
    hdiutil create -volname 'Stream Keys' -srcfolder dmg-contents -ov -format UDZO "$OUTPUT_FILE"
    rm -rf dmg-contents

    # Step 6: Notarize
    echo ""
    echo "Step 6/$TOTAL_STEPS: Submitting for notarization (this may take a few minutes)..."
    NOTARY_OUTPUT=$(xcrun notarytool submit "$OUTPUT_FILE" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" \
        --wait 2>&1)
    echo "$NOTARY_OUTPUT"

    # Extract submission ID for potential log retrieval
    SUBMISSION_ID=$(echo "$NOTARY_OUTPUT" | grep -E "^\s*id:" | head -1 | awk '{print $2}')

    # Step 7: Staple (with retry for propagation delay)
    echo ""
    echo "Step 7/$TOTAL_STEPS: Stapling notarization ticket..."
    MAX_RETRIES=5
    RETRY_DELAY=15
    echo "Waiting ${RETRY_DELAY}s for notarization ticket to propagate..."
    sleep $RETRY_DELAY
    for i in $(seq 1 $MAX_RETRIES); do
        if xcrun stapler staple "$OUTPUT_FILE" 2>/dev/null; then
            echo "Stapling successful!"
            break
        else
            if [ $i -eq $MAX_RETRIES ]; then
                echo "Error: Stapling failed after $MAX_RETRIES attempts."
                echo ""
                if [ -n "$SUBMISSION_ID" ]; then
                    echo "Fetching notarization log for submission $SUBMISSION_ID..."
                    xcrun notarytool log "$SUBMISSION_ID" \
                        --apple-id "$APPLE_ID" \
                        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
                        --team-id "$APPLE_TEAM_ID" 2>&1 || true
                fi
                exit 1
            fi
            echo "Stapling failed (attempt $i/$MAX_RETRIES). Waiting ${RETRY_DELAY}s for ticket propagation..."
            sleep $RETRY_DELAY
        fi
    done

else
    # App Store build: Create signed .pkg
    
    # Step 5: Create signed installer package
    echo ""
    echo "Step 5/$TOTAL_STEPS: Creating signed installer package..."
    cd "$PROJECT_ROOT/build/production/safari"
    
    productbuild \
        --component "xcode/DerivedData/Build/Products/Release/Stream Keys.app" /Applications \
        --sign "3rd Party Mac Developer Installer: Viktor Stískala (D8Z6CRA2WJ)" \
        "$OUTPUT_FILE"
    
    echo "Package created: $OUTPUT_FILE"
    echo ""
    echo "Note: App Store packages are not notarized - Apple handles this during review."
fi

echo ""
echo "=== Build Complete ==="
echo "Output: build/production/safari/$OUTPUT_FILE"
if [ "$BUILD_TYPE" = "dmg" ]; then
    echo "The DMG is signed and notarized, ready for distribution."
else
    echo "The package is ready for upload to App Store Connect."
    echo "Upload using Transporter app or: xcrun altool --upload-app -f build/production/safari/$OUTPUT_FILE -t macos"
fi
