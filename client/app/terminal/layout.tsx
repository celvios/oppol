import ClientShell from "@/components/layout/ClientShell";

export default function TerminalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ClientShell>
            {children}
        </ClientShell>
    );
}
