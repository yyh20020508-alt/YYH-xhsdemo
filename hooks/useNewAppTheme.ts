import { useEffect } from 'react';
export function useNewAppTheme() {
    useEffect(() => {
        const rem = () => { document.documentElement.style.fontSize = Math.min(window.innerWidth / 375 * 16, 20) + 'px'; };
        rem();
        window.addEventListener('resize', rem);
        return () => window.removeEventListener('resize', rem);
    }, []);
    return { isDark: false, theme: 'light' as const, fontLevel: '2' as const, toggleTheme: () => {} };
}
