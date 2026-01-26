import ClientShell from "@/components/layout/ClientShell";

export default function TerminalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    <ClientShell>
        {children}
    </ClientShell>
}
