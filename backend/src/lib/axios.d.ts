// Type declaration for axios to satisfy TypeScript compiler when @types/axios is not installed.
declare module "axios" {
    const axios: any;
    export default axios;
}
