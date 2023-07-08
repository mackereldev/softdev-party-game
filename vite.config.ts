import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
    server: {
        port: 5173,
        strictPort: true,
        watch: {
            ignored: ["**/server/**"],
        },
    },
    build: {
        sourcemap: true,
        emptyOutDir: true,
    },
    plugins: [sveltekit()],
});
