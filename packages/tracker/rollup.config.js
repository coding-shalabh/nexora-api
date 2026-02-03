import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default [
  // UMD build (for <script> tag)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/tracker.js',
      format: 'umd',
      name: 'CRM360Tracker',
      sourcemap: true,
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      production && terser(),
    ],
  },
  // ESM build (for bundlers)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/tracker.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json', declaration: true, declarationDir: 'dist' }),
    ],
    external: ['rrweb'],
  },
  // Minified UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/tracker.min.js',
      format: 'umd',
      name: 'CRM360Tracker',
      sourcemap: true,
    },
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
      terser({
        compress: {
          drop_console: true,
        },
      }),
    ],
  },
];
