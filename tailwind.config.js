/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        present: { DEFAULT: "#16a34a", light: "#f0fdf4", border: "#bbf7d0" },
        absent: { DEFAULT: "#dc2626", light: "#fef2f2", border: "#fecaca" },
        late: { DEFAULT: "#d97706", light: "#fffbeb", border: "#fde68a" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      fontFamily: {
        sans: ["Inter var", "Inter", "system-ui", "-apple-system", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-lg": "0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)",
        "card-hover": "0 8px 16px -4px rgb(0 0 0 / 0.08), 0 4px 6px -2px rgb(0 0 0 / 0.06)",
        focus: "0 0 0 3px rgb(59 130 246 / 0.12)"
      },
      transitionDuration: {
        DEFAULT: "150ms",
        fast: "100ms",
        220: "220ms",
        slow: "300ms"
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.25, 1, 0.5, 1)",
        out: "cubic-bezier(0.25, 1, 0.5, 1)",
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "route-enter": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "surface-pop": {
          from: { opacity: "0", transform: "translateY(4px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" }
        },
        "check-in": {
          from: { opacity: "0", transform: "scale(0.75) rotate(-8deg)" },
          to: { opacity: "1", transform: "scale(1) rotate(0)" }
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" }
        },
        progress: {
          "0%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(100%)" }
        }
      },
      animation: {
        "fade-in": "fade-in 150ms cubic-bezier(0.25, 1, 0.5, 1)",
        "slide-up": "slide-up 150ms cubic-bezier(0.25, 1, 0.5, 1)",
        "slide-down": "slide-down 150ms cubic-bezier(0.25, 1, 0.5, 1)",
        "route-enter": "route-enter 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        "surface-pop": "surface-pop 180ms cubic-bezier(0.22, 1, 0.36, 1)",
        "check-in": "check-in 140ms cubic-bezier(0.22, 1, 0.36, 1)",
        "accordion-down": "accordion-down 0.2s cubic-bezier(0.25, 1, 0.5, 1)",
        "accordion-up": "accordion-up 0.16s cubic-bezier(0.25, 1, 0.5, 1)",
        progress: "progress 1.5s ease-in-out infinite"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
}
