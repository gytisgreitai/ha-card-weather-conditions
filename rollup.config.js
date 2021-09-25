import resolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import babel from 'rollup-plugin-babel';
import execute from 'rollup-plugin-execute';

export default {
    input: ['src/ha-card-weather-conditions.ts'],
    output: {
        dir: './dist',
        format: 'esm',
        sourceMap: 'inline'
    },
    plugins: [
        resolve(),
        typescript(),
        babel({
            exclude: 'node_modules/**'
        }),
        execute([
            'echo "$(date \'+%d/%m/%Y %H:%M:%S\') rollup done." ; echo -e \'\\007\''
        ])
    ]
};