import ClientShell from "@/components/layout/ClientShell";

export default function AppLayout({
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
