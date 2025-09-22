/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Custom colors for Fake Detector App
        "brand-yellow": "#FFD700",
        "brand-yellow-light": "#FFF3CD",
        "brand-blue": "#1E40AF",
        "brand-blue-light": "#3B82F6",
        "product-purple": "#8B5CF6",
        "upload-gray": "#6B7280",
        "cta-blue": "#2563EB",
        nafdac: {
          primary: "#007acc",
          secondary: "#00a0e6",
          accent: "#4fc3f7",
        },
      },
      backgroundImage: {
        "gradient-yellow-blue": "linear-gradient(135deg, #FFD700 0%, #3B82F6 100%)",
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "logo-gradient": "linear-gradient(45deg, #FFD700, #FFF3CD, #3B82F6, #1E40AF)",
      },
      boxShadow: {
        "upload-area": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        "result-card": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.5s ease-out",
        "pulse-border": "pulseBorder 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(1rem)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseBorder: {
          "0%": { boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.7)" },
          "70%": { boxShadow: "0 0 0 10px rgba(59, 130, 246, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(59, 130, 246, 0)" },
        },
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
        "128": "32rem",
        "144": "36rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        ".upload-zone": {
          border: "2px dashed #9CA3AF",
          transition: "all 0.3s ease",
        },
        ".upload-zone.hover": {
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.05)",
        },
        ".upload-zone.drag-over": {
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          transform: "scale(0.98)",
        },
        ".gradient-text": {
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        },
      });
    },
  ],
}