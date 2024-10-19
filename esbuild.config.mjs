import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import copy from 'esbuild-plugin-copy';

// Banner message for the generated/bundled files
const banner = `
/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

// Determine whether to build for production or development
const prod = (process.argv[2] === "production");

// Get the output directory
const outdir = 'dist';

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins
	],
	format: "cjs",
    target: "es2022",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    minify: prod,
    minifySyntax: prod, // Enable syntax minification in production
    minifyWhitespace: prod, // Disable whitespace minification
    minifyIdentifiers: prod, // Disable identifier minification
    outdir,
    define: {
        "process.env.NODE_ENV": JSON.stringify(prod ? "production" : "development"),
    },
    treeShaking: prod,
	plugins: [
		copy({
			assets: {
				from: ['./manifest.json'],
				to: ['./manifest.json']
			}
		}),
		copy({
			assets: {
				from: ['./styles/styles.css'],
				to: ['./styles.css']
			}
		})
	],
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}