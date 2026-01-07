# =============================================================================
# Helpers - Utility functions for logging, commands, and cleanup
# =============================================================================

# Logging helpers
info() { echo -e "${BLUE}$1${NC}"; }
success() { echo -e "  ${GREEN}✓ $1${NC}"; }
error() { echo -e "  ${RED}✗ ERROR: $1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }

# Run a command - output goes directly to terminal (preserves colors/TTY)
run() {
    "$@"
}

# Helper for notarytool commands
notarytool() {
    xcrun notarytool "$@" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID"
}

# Trap handler for errors and exit
cleanup() {
    local exit_code=$?
    
    # Mark current step as failed if we're exiting with error
    if [ $exit_code -ne 0 ] && [ $CURRENT_STEP -gt 0 ]; then
        STEP_STATUSES[$((CURRENT_STEP - 1))]="fail"
        [ "$IS_TTY" = true ] && update_step_status $((CURRENT_STEP - 1)) "fail"
    fi
    
    # Reset terminal display before printing summary
    cleanup_display
    
    print_summary
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}=== Build Complete ===${NC}"
        info "Output: $OUTPUT_PATH"
        
        if [ "$BUILD_TYPE" = "dmg" ]; then
            if [ "$SIGNED" = true ]; then
                info "The DMG is signed and notarized, ready for distribution."
            else
                info "The DMG is for local testing only (ad-hoc signed, not notarized)."
            fi
        else
            info "The package is ready for upload to App Store Connect."
            info "Upload using Transporter app or: xcrun altool --upload-app -f $OUTPUT_PATH -t macos"
        fi
    else
        echo -e "${RED}=== Build Failed ===${NC}"
    fi
    
    exit $exit_code
}
