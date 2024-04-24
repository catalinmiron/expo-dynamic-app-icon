"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("@expo/config-plugins");
const image_utils_1 = require("@expo/image-utils");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// @ts-ignore
const pbxFile_1 = __importDefault(require("xcode/lib/pbxFile"));
const { getMainApplicationOrThrow, getMainActivityOrThrow, } = config_plugins_1.AndroidConfig.Manifest;
const androidFolderPath = ["app", "src", "main", "res"];
const androidFolderNames = [
    "mipmap-hdpi",
    "mipmap-mdpi",
    "mipmap-xhdpi",
    "mipmap-xxhdpi",
    "mipmap-xxxhdpi",
];
const androidSize = [162, 108, 216, 324, 432];
const iosFolderName = "DynamicAppIcons";
const iosSize = 60;
const ipad152Scale = 2.53;
const ipad167Scale = 2.78;
const iosScales = [2, 3, ipad152Scale, ipad167Scale];
function arrayToImages(images) {
    return images.reduce((prev, curr, i) => ({ ...prev, [i]: { image: curr } }), {});
}
const findIconsForPlatform = (icons, platform) => {
    return Object.keys(icons)
        .filter(key => {
        const icon = icons[key];
        if (icon.platforms) {
            return icon['platforms'].includes(platform);
        }
        return true;
    })
        .reduce((prev, curr) => ({ ...prev, [curr]: icons[curr] }), {});
};
const withDynamicIcon = (config, props = {}) => {
    const _props = props || {};
    let prepped = {};
    if (Array.isArray(_props)) {
        prepped = arrayToImages(_props);
    }
    else if (_props) {
        prepped = _props;
    }
    const iOSIcons = findIconsForPlatform(prepped, "ios");
    const iOSIconsLength = Object.keys(iOSIcons).length;
    if (iOSIconsLength > 0) {
        config = withIconXcodeProject(config, { icons: iOSIcons });
        config = withIconInfoPlist(config, { icons: iOSIcons });
        config = withIconIosImages(config, { icons: iOSIcons });
    }
    const androidIcons = findIconsForPlatform(prepped, "android");
    const androidIconsLength = Object.keys(androidIcons).length;
    if (androidIconsLength > 0) {
        config = withIconAndroidManifest(config, { icons: androidIcons });
        config = withIconAndroidImages(config, { icons: androidIcons });
    }
    return config;
};
// for aos
const withIconAndroidManifest = (config, { icons }) => {
    return (0, config_plugins_1.withAndroidManifest)(config, (config) => {
        const mainApplication = getMainApplicationOrThrow(config.modResults);
        const mainActivity = getMainActivityOrThrow(config.modResults);
        const iconNamePrefix = `${config.android.package}.MainActivity`;
        const iconNames = Object.keys(icons);
        function addIconActivityAlias(config) {
            return [
                ...config,
                ...iconNames.map((iconName) => ({
                    $: {
                        "android:name": `${iconNamePrefix}${iconName}`,
                        "android:enabled": "false",
                        "android:exported": "true",
                        "android:icon": `@mipmap/${iconName}`,
                        "android:targetActivity": ".MainActivity",
                    },
                    "intent-filter": [...mainActivity["intent-filter"] || [
                            {
                                action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
                                category: [
                                    { $: { "android:name": "android.intent.category.LAUNCHER" } },
                                ],
                            },
                        ]]
                })),
            ];
        }
        function removeIconActivityAlias(config) {
            return config.filter((activityAlias) => !activityAlias.$["android:name"].startsWith(iconNamePrefix));
        }
        mainApplication["activity-alias"] = removeIconActivityAlias(mainApplication["activity-alias"] || []);
        mainApplication["activity-alias"] = addIconActivityAlias(mainApplication["activity-alias"] || []);
        return config;
    });
};
const withIconAndroidImages = (config, { icons }) => {
    return (0, config_plugins_1.withDangerousMod)(config, [
        "android",
        async (config) => {
            const androidResPath = path_1.default.join(config.modRequest.platformProjectRoot, ...androidFolderPath);
            const removeIconRes = async () => {
                for (let i = 0; androidFolderNames.length > i; i += 1) {
                    const folder = path_1.default.join(androidResPath, androidFolderNames[i]);
                    const files = await fs_1.default.promises.readdir(folder).catch(() => []);
                    for (let j = 0; files.length > j; j += 1) {
                        if (!files[j].startsWith("ic_launcher")) {
                            await fs_1.default.promises
                                .rm(path_1.default.join(folder, files[j]), { force: true })
                                .catch(() => null);
                        }
                    }
                }
            };
            const addIconRes = async () => {
                for (let i = 0; androidFolderNames.length > i; i += 1) {
                    const size = androidSize[i];
                    const outputPath = path_1.default.join(androidResPath, androidFolderNames[i]);
                    for (const [name, { image }] of Object.entries(icons)) {
                        const fileName = `${name}.png`;
                        const { source } = await (0, image_utils_1.generateImageAsync)({
                            projectRoot: config.modRequest.projectRoot,
                            cacheType: "react-native-dynamic-app-icon",
                        }, {
                            name: fileName,
                            src: image,
                            // removeTransparency: true,
                            backgroundColor: "#ffffff",
                            resizeMode: "cover",
                            width: size,
                            height: size,
                        });
                        await fs_1.default.promises.writeFile(path_1.default.join(outputPath, fileName), source);
                    }
                }
                // for (const size of ) {
                //   // size
                //   const iconFileName = "";
                //   const fileName = path.join(iosFolderName, iconFileName);
                //   const outputPath = path.join(iosRoot, fileName);
                //   const scaledSize = scale * iosSize;
                // }
            };
            await removeIconRes();
            await addIconRes();
            return config;
        },
    ]);
};
// for ios
function getIconName(name, size, scale) {
    const fileName = `${name}-Icon-$${size}x${size}`;
    if (scale != null) {
        if (scale == ipad152Scale) {
            return `${fileName}@2x~ipad.png`;
        }
        if (scale == ipad167Scale) {
            return `${fileName}@3x~ipad.png`;
        }
        return `${fileName}@${scale}x.png`;
    }
    return fileName;
}
const withIconXcodeProject = (config, { icons }) => {
    return (0, config_plugins_1.withXcodeProject)(config, async (config) => {
        const groupPath = `${config.modRequest.projectName}/${iosFolderName}`;
        const group = config_plugins_1.IOSConfig.XcodeUtils.ensureGroupRecursively(config.modResults, groupPath);
        const project = config.modResults;
        const opt = {};
        // Unlink old assets
        const groupId = Object.keys(project.hash.project.objects["PBXGroup"]).find((id) => {
            const _group = project.hash.project.objects["PBXGroup"][id];
            return _group.name === group.name;
        });
        if (!project.hash.project.objects["PBXVariantGroup"]) {
            project.hash.project.objects["PBXVariantGroup"] = {};
        }
        const variantGroupId = Object.keys(project.hash.project.objects["PBXVariantGroup"]).find((id) => {
            const _group = project.hash.project.objects["PBXVariantGroup"][id];
            return _group.name === group.name;
        });
        const children = [...(group.children || [])];
        for (const child of children) {
            const file = new pbxFile_1.default(path_1.default.join(group.name, child.comment), opt);
            file.target = opt ? opt.target : undefined;
            project.removeFromPbxBuildFileSection(file); // PBXBuildFile
            project.removeFromPbxFileReferenceSection(file); // PBXFileReference
            if (group) {
                if (groupId) {
                    project.removeFromPbxGroup(file, groupId); //Group other than Resources (i.e. 'splash')
                }
                else if (variantGroupId) {
                    project.removeFromPbxVariantGroup(file, variantGroupId); // PBXVariantGroup
                }
            }
            project.removeFromPbxResourcesBuildPhase(file); // PBXResourcesBuildPhase
        }
        // Link new assets
        await iterateIconsAsync({ icons }, async (key, icon, index) => {
            for (const scale of iosScales) {
                const iconFileName = getIconName(key, iosSize, scale);
                if (!group?.children.some(({ comment }) => comment === iconFileName)) {
                    // Only write the file if it doesn't already exist.
                    config.modResults = config_plugins_1.IOSConfig.XcodeUtils.addResourceFileToGroup({
                        filepath: path_1.default.join(groupPath, iconFileName),
                        groupName: groupPath,
                        project: config.modResults,
                        isBuildFile: true,
                        verbose: true,
                    });
                }
                else {
                    console.log("Skipping duplicate: ", iconFileName);
                }
            }
        });
        return config;
    });
};
const withIconInfoPlist = (config, { icons }) => {
    return (0, config_plugins_1.withInfoPlist)(config, async (config) => {
        const altIcons = {};
        await iterateIconsAsync({ icons }, async (key, icon) => {
            altIcons[key] = {
                CFBundleIconFiles: [
                    // Must be a file path relative to the source root (not a icon set it seems).
                    // i.e. `Bacon-Icon-60x60` when the image is `ios/somn/appIcons/Bacon-Icon-60x60@2x.png`
                    getIconName(key, iosSize),
                ],
                UIPrerenderedIcon: !!icon.prerendered,
            };
        });
        function applyToPlist(key) {
            if (typeof config.modResults[key] !== "object" ||
                Array.isArray(config.modResults[key]) ||
                !config.modResults[key]) {
                config.modResults[key] = {};
            }
            // @ts-expect-error
            config.modResults[key].CFBundleAlternateIcons = altIcons;
            // @ts-expect-error
            config.modResults[key].CFBundlePrimaryIcon = {
                CFBundleIconFiles: ["AppIcon"],
            };
        }
        // Apply for both tablet and phone support
        applyToPlist("CFBundleIcons");
        applyToPlist("CFBundleIcons~ipad");
        return config;
    });
};
const withIconIosImages = (config, props) => {
    return (0, config_plugins_1.withDangerousMod)(config, [
        "ios",
        async (config) => {
            await createIconsAsync(config, props);
            return config;
        },
    ]);
};
async function createIconsAsync(config, { icons }) {
    const iosRoot = path_1.default.join(config.modRequest.platformProjectRoot, config.modRequest.projectName);
    // Delete all existing assets
    await fs_1.default.promises
        .rm(path_1.default.join(iosRoot, iosFolderName), { recursive: true, force: true })
        .catch(() => null);
    // Ensure directory exists
    await fs_1.default.promises.mkdir(path_1.default.join(iosRoot, iosFolderName), {
        recursive: true,
    });
    // Generate new assets
    await iterateIconsAsync({ icons }, async (key, icon) => {
        for (const scale of iosScales) {
            const iconFileName = getIconName(key, iosSize, scale);
            const fileName = path_1.default.join(iosFolderName, iconFileName);
            const outputPath = path_1.default.join(iosRoot, fileName);
            const scaledSize = Math.ceil(scale * iosSize);
            const { source } = await (0, image_utils_1.generateImageAsync)({
                projectRoot: config.modRequest.projectRoot,
                cacheType: "react-native-dynamic-app-icon",
            }, {
                name: iconFileName,
                src: icon.image,
                removeTransparency: true,
                backgroundColor: "#ffffff",
                resizeMode: "cover",
                width: scaledSize,
                height: scaledSize,
            });
            await fs_1.default.promises.writeFile(outputPath, source);
        }
    });
}
async function iterateIconsAsync({ icons }, callback) {
    const entries = Object.entries(icons);
    for (let i = 0; i < entries.length; i++) {
        const [key, val] = entries[i];
        await callback(key, val, i);
    }
}
exports.default = withDynamicIcon;
