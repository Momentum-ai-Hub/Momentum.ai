import './globals.css';

export const metadata = {
  title: 'Momentum AI',
  description: 'Earnings Intelligence · Pre-Drift · Matières Premières',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
