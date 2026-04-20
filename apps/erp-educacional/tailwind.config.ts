import type { Config } from "tailwindcss";

const config: Config = {
  // dark mode via classe .dark no <html> (controlado pelo ThemeProvider)
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cores do Diploma Digital FIC
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#1e40af",
          600: "#1e3a8a",
          700: "#1e3375",
          800: "#1a2d60",
          900: "#15244d",
        },
        accent: {
          50: "#fefce8",
          100: "#fef9c3",
          500: "#eab308",
          600: "#ca8a04",
        },
        // ========================================================
        // Design tokens do Módulo Atendimento (baseline Nexvy/DKW)
        // Referência: docs/research/nexvy-whitelabel/
        // Fonte: PLANO-REFORMULACAO-ATENDIMENTO-FIC.md Parte 2.2
        // ========================================================
        atnd: {
          // Primary (azul royal Nexvy)
          primary:       "#345EF3",
          "primary-hover":"#2B4ECF",
          "primary-bg":  "#EEF1FE",
          // Neutros
          bg:            "#FFFFFF",
          "bg-subtle":   "#F5F7FA",
          "bg-muted":    "#F0F2F5",
          border:        "#E4E7EC",
          "border-strong":"#D0D5DD",
          text:          "#1D2939",
          "text-muted":  "#667085",
          "text-subtle": "#98A2B3",
          // Semânticos
          success:       "#12B76A",
          warning:       "#F79009",
          danger:        "#F04438",
          info:          "#0BA5EC",
          // Filas canônicas FIC (padrão seed — mantém paridade visual com Nexvy real)
          "queue-secretaria":"#345EF3",
          "queue-financeiro":"#F79009",
          "queue-matriculas":"#12B76A",
          // Status atendente (dot colorido)
          "status-online": "#12B76A",
          "status-offline":"#98A2B3",
          "status-paused": "#F79009",
          // Chat bubble WhatsApp-like
          "bubble-out":    "#DCF8C6",  // verde claro WhatsApp
          "bubble-in":     "#FFFFFF",
        },
      },
      fontFamily: {
        // Atendimento segue Roboto (Nexvy). Outros módulos mantêm padrão Tailwind.
        atnd: ['Roboto', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        // Escala Nexvy (14px base)
        'atnd-xs': ['12px', { lineHeight: '16px' }],
        'atnd-sm': ['13px', { lineHeight: '18px' }],
        'atnd':    ['14px', { lineHeight: '20px' }],
        'atnd-md': ['15px', { lineHeight: '22px' }],
        'atnd-lg': ['16px', { lineHeight: '24px' }],
      },
      borderRadius: {
        'atnd-sm': '6px',
        'atnd-md': '8px',
        'atnd-lg': '10px',
      },
      spacing: {
        // Medidas canônicas de layout do atendimento
        'atnd-sidebar': '245px',  // menu lateral principal
        'atnd-list':    '320px',  // lista de conversas
        'atnd-info':    '360px',  // painel direito de contato
        'atnd-kanban':  '300px',  // largura coluna kanban
        'atnd-topbar':  '56px',
      },
      boxShadow: {
        'atnd-sm': '0 1px 2px rgba(16,24,40,0.06)',
        'atnd-md': '0 4px 8px -2px rgba(16,24,40,0.1)',
        'atnd-lg': '0 12px 16px -4px rgba(16,24,40,0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
