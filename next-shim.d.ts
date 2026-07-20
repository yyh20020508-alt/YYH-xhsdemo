declare module 'next/app' {
    export type AppProps = {
        Component: React.ComponentType<Record<string, unknown>>;
        pageProps: Record<string, unknown>;
    };
}

declare module 'next/dynamic' {
    const dynamic: <T>(loader: () => Promise<T>, options?: {ssr?: boolean}) => T;
    export default dynamic;
}

declare module 'next/head' {
    const Head: React.ComponentType<React.PropsWithChildren>;
    export default Head;
}

declare module '*.module.css' {
    const classes: Record<string, string>;
    export default classes;
}
