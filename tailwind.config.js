/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                ptdf: {
                    50: '#eefdf4',
                    100: '#dcfce9',
                    200: '#bbf7d0',
                    300: '#006B3E',
                    500: '#22c55e',
                    600: '#006B3E',
                    700: '#005532',
                    800: '#004226',
                    900: '#00331e',
                },
                accent: {
                    50: '#fffdf0',
                    100: '#fff9c2',
                    500: '#FFCC00',
                    600: '#e6b800',
                    700: '#b38f00',
                }
            },
            animation: {
                fadeIn: 'fadeIn 0.5s ease-out',
                slideIn: 'slideIn 0.3s ease-out',
                blob: 'blob 7s infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideIn: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                }
            }
        }
    },
    plugins: [],
}
