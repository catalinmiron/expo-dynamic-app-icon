import { ConfigPlugin } from "@expo/config-plugins";
type Platform = "ios" | "android";
type Icon = {
    image: string;
    prerendered?: boolean;
    platforms?: Platform[];
};
type IconSet = Record<string, Icon>;
declare const withDynamicIcon: ConfigPlugin<string[] | IconSet | void>;
export default withDynamicIcon;
