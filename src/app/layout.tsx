import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LOADER_INIT_SCRIPT, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Direccion publica del sitio. Es la base de las URLs absolutas que necesitan
 * las tarjetas de WhatsApp y las redes: una URL relativa ahi no resuelve.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://energia-sur.netlify.app";

/**
 * Metadatos del sitio.
 *
 * Conviene ser claro sobre que aporta y que no. La aplicacion entera vive
 * detras del login, asi que ningun buscador puede entrar a ver el Monitor ni
 * el Consumo: optimizar esas pantallas para buscadores no tendria efecto.
 *
 * Lo que si tiene efecto, y es lo que se hace aca:
 *   - Que un enlace compartido por WhatsApp o redes muestre nombre, resumen e
 *     imagen en vez de una URL pelada. Es la unica "vidriera" real que tiene
 *     hoy la app, y es por donde llegan los usuarios.
 *   - Que las paginas publicas (ingresar y crear cuenta) se indexen bien y las
 *     privadas queden fuera del indice.
 *   - Que el navegador la reconozca como aplicacion instalable.
 *
 * Para aparecer en buscadores por busquedas del tipo "medir consumo electrico"
 * haria falta contenido publico —una pagina de presentacion abierta—, que hoy
 * no existe.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "EnergIA Sur · Monitor de consumo eléctrico",
    // Cada pantalla define su propio titulo y hereda la marca.
    template: "%s · EnergIA Sur",
  },
  description:
    "Seguí el consumo eléctrico de tu casa en tiempo real: tensión, potencia, cuánto llevás gastado del mes y avisos cuando algo anda mal en la instalación.",
  applicationName: "EnergIA Sur",
  authors: [{ name: "EnergIA Sur" }],
  keywords: [
    "consumo eléctrico",
    "medidor inteligente",
    "monitoreo de energía",
    "ahorro de luz",
    "tarifa eléctrica",
  ],
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "EnergIA Sur",
    title: "EnergIA Sur · Monitor de consumo eléctrico",
    description:
      "Seguí el consumo eléctrico de tu casa en tiempo real y enterate a tiempo si algo anda mal en la instalación.",
  },
  twitter: {
    card: "summary_large_image",
    title: "EnergIA Sur · Monitor de consumo eléctrico",
    description:
      "Seguí el consumo eléctrico de tu casa en tiempo real y enterate a tiempo si algo anda mal en la instalación.",
  },
  // El contenido real esta detras del login: no hay nada que indexar adentro.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: {
    // Sin esto, iOS convierte en enlaces de llamada cualquier numero que se
    // parezca a un telefono — incluidos los valores de los medidores.
    telephone: false,
  },
};

export const viewport: Viewport = {
  // La app se usa como aplicación de celular: sin zoom accidental al tocar
  // campos, y respetando el área segura de pantallas con notch.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Pinta la barra del navegador del color del fondo, en cada tema. Es lo que
  // hace que en el celular la app no se vea "pegada" adentro de una pagina.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1017" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      // El script del tema modifica <html> antes de que React hidrate: sin
      // esto, React avisaría de una discrepancia que en realidad es esperada.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LOADER_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Marcado plano, sin React: ver la nota en globals.css. */}
        <div id="app-loader" aria-hidden="true">
          <span className="animate-energia-pulse inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-accent">
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
          </span>
          <p className="text-sm font-medium text-muted">Cargando EnergIA Sur…</p>
        </div>

        {children}
      </body>
    </html>
  );
}
