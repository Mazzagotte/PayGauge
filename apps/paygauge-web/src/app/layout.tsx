import "../styles/tokens.css";

export const metadata = {
  title: "PayGauge",
  description: "See what's left.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
