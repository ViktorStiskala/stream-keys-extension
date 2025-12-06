.PHONY: build clean

BUILD_DIR = build
PACKAGE_NAME = stream-keys.zip

# Files to include in the package
PACKAGE_FILES = \
	main.js \
	manifest.json \
	services/disney.js \
	services/hbomax.js \
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

