export const NewAppBridge = {
    loading: { hideNative: () => {} },
    share: { setShareInfo: () => {} },
    theme: { getTheme: async () => 'light', onThemeChange: () => () => {} },
    font: { getFontLevel: async () => '2', onFontChange: () => () => {} },
    env: { isInApp: false, isIos: false, isAndroid: false, canIUse: (_: string) => false },
    toast: {
        success: (msg: string) => alert(msg),
        error: (msg: string) => alert(msg),
        info: (msg: string) => alert(msg),
    },
    image: {
        save: (dataUrl: string) => {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'image.png';
            a.click();
            return Promise.resolve();
        },
    },
};
