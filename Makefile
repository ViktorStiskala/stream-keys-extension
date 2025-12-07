.PHONY: build clean

BUILD_DIR = build
PACKAGE_NAME = stream-keys.zip

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
	logo/StreamKeys_16.png \
	logo/StreamKeys_32.png \
	logo/StreamKeys_48.png \
	logo/StreamKeys_128.png

build: clean
	@mkdir -p $(BUILD_DIR)
	@zip -r $(BUILD_DIR)/$(PACKAGE_NAME) $(PACKAGE_FILES)
	@echo "Created $(BUILD_DIR)/$(PACKAGE_NAME)"

clean:
	@rm -rf $(BUILD_DIR)

