PROJ_DIR ?= .
BUILD_DIR ?= $(PROJ_DIR)/build
OSM_DIR ?= $(PROJ_DIR)/osm_firmware
OSM_BUILD_DIR ?= $(OSM_DIR)/build
MODEL_DIR ?= $(OSM_DIR)/model
FW_GIT_TAG2 := $(shell cd $(OSM_DIR) && git describe --tags --abbrev=0 --dirty)
FW_GIT_SHA1 := $(shell cd $(OSM_DIR) && printf "%.*s\n" 7 $$(git log -n 1 --format="%H"))
REAL_MODELS = $(shell find $(MODEL_DIR)/* -maxdepth 0 -type d ! -name "*penguin*" -printf '%f\n')
WEBSERVE_DIR := $(PROJ_DIR)/app

WEBROOT_BUILD_DIR := $(BUILD_DIR)/webroot
WEBROOT_LIB_BUILD_DIR := $(WEBROOT_BUILD_DIR)/libs

all: webroot $(BUILD_DIR)/firmware.elf

define WEBSERVE_BUILT_FILES
$(1)_SRC := $(shell find $(2) -type f)
$(1) := $$(patsubst $$(WEBSERVE_DIR)/%,$$(WEBROOT_BUILD_DIR)/%,$$($(1)_SRC))
all: $$($(1))
$$($(1)): $$(WEBROOT_BUILD_DIR)/%: $$(WEBSERVE_DIR)/%
	@mkdir -p $$(@D)
	echo $$< $$@
	cp $$< $$@
endef

$(eval $(call WEBSERVE_BUILT_FILES,WEBSERVE_GUI,$(WEBSERVE_DIR)/modules/gui))
$(eval $(call WEBSERVE_BUILT_FILES,WEBSERVE_BACKEND,$(WEBSERVE_DIR)/modules/backend))
$(eval $(call WEBSERVE_BUILT_FILES,WEBSERVE_IMG,$(WEBSERVE_DIR)/imgs))
$(eval $(call WEBSERVE_BUILT_FILES,WEBSERVE_STYLES,$(WEBSERVE_DIR)/styles))

FW_VERSION_INFO := $(WEBROOT_BUILD_DIR)/fw_releases/latest_fw_info.json

webroot: $(WEBROOT_BUILD_DIR)/index.html $(WEBROOT_BUILD_DIR)/favicon.ico $(WEBSERVE_GUI) $(WEBSERVE_BACKEND) $(WEBSERVE_IMG) $(WEBSERVE_STYLES) $(BUILD_DIR)/.webroot/libs $(BUILD_DIR)/aioserver.py $(BUILD_DIR)/.webroot/fw_releases

.PHONY: webhost

webhost: webroot
	cd $(BUILD_DIR); \
	python3 ./aioserver.py

$(WEBROOT_BUILD_DIR)/%: $(WEBSERVE_DIR)/%
	@mkdir -p $(@D)
	cp $< $@

$(BUILD_DIR)/aioserver.py: $(WEBSERVE_DIR)/aioserver.py
	@mkdir -p $(@D)
	cp $< $@

$(BUILD_DIR)/.webroot/libs: $(BUILD_DIR)/.webroot/lib_stm32flash
	@mkdir -p $(@D)
	touch $@

$(BUILD_DIR)/.webroot/lib_stm32flash:
	@mkdir -p $(WEBROOT_LIB_BUILD_DIR)/stm-serial-flasher/
	rsync -ar --include='*.js' --exclude='*.*' $(WEBSERVE_DIR)/modules/stm-serial-flasher/src/ $(WEBROOT_LIB_BUILD_DIR)/stm-serial-flasher
	@mkdir -p $(@D)
	touch $@

$(BUILD_DIR)/.webroot/fw_releases:
	$(shell mkdir -p $(WEBROOT_BUILD_DIR)/fw_releases)
	touch $(FW_VERSION_INFO)
	@mkdir -p $(@D)
	touch $@

dev_fw: $(WEBROOT_BUILD_DIR)/fw_releases
	cp $(PROJ_DIR)/fw_releases/* $(WEBROOT_BUILD_DIR)/fw_releases/


$(BUILD_DIR)/firmware.elf:
	$(MAKE) -C osm_firmware penguin_at_wifi
	cp osm_firmware/build/penguin_at_wifi/firmware.elf $(BUILD_DIR)/firmware.elf
	cp -r osm_firmware/build/penguin_at_wifi/peripherals $(BUILD_DIR)/peripherals

clean:
	rm -rf $(BUILD_DIR)
