export const metadata = {
  title: "Transfer Pulse",
  description: "Latest football transfers from trusted sources",
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}
