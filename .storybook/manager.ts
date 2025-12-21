import { addons } from "storybook/manager-api";
import { themes } from "storybook/theming";

addons.setConfig({
  theme: {
    ...themes.dark,
    // Brand customization
    brandTitle: "BOTTB Design System",
    brandUrl: "/",
    
    // Colors to match BOTTB design
    appBg: "#0a0a0a",
    appContentBg: "#0a0a0a",
    appBorderColor: "#333333",
    appBorderRadius: 8,
    
    // Text colors
    textColor: "#ffffff",
    textInverseColor: "#0a0a0a",
    textMutedColor: "#999999",
    
    // Toolbar colors
    barTextColor: "#999999",
    barSelectedColor: "#F5A623",
    barHoverColor: "#F5A623",
    barBg: "#141414",
    
    // Input colors
    inputBg: "#141414",
    inputBorder: "#333333",
    inputTextColor: "#ffffff",
    inputBorderRadius: 4,
  },
});

