import "./globals.css";

export const metadata = {
  title: "MuskPulse Leaderboard",
  description: "Real-time sales leaderboard for Elon Musk's companies",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}