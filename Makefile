.PHONY: build clean

BUILD_DIR = build
PACKAGE_NAME = stream-keys.zip
ICON_SOURCE = assets/icon.png
LOGO_SIZES = 16 32 48 128
LOGO_FILES = $(addprefix logo/StreamKeys_,$(addsuffix .png,$(LOGO_SIZES)))

# Files to include in the package
# NOTE: Update these paths when changing project structure or adding new handlers
PACKAGE_FILES = \
	main.js \
	manifest.json \
	handlers/base.js \
	handlers/disney.js \
	handlers/hbomax.js \
	settings/settings.html \
	settings/settings.js \
	settings/settings.css \
	$(LOGO_FILES)

# Generate logo files from source icon
logo/StreamKeys_%.png: $(ICON_SOURCE)
	@mkdir -p logo
	@magick $(ICON_SOURCE) -filter Lanczos -resize $*x$* $@
	@echo "Generated $@"

logos: $(LOGO_FILES)

build: clean $(LOGO_FILES)
	@mkdir -p $(BUILD_DIR)
	@zip -r $(BUILD_DIR)/$(PACKAGE_NAME) $(PACKAGE_FILES)
	@echo "Created $(BUILD_DIR)/$(PACKAGE_NAME)"

clean:
	@rm -rf $(BUILD_DIR)

