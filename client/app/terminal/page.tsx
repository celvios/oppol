"use client";

import { DesktopTerminal } from "@/components/terminal/DesktopTerminal";
import { MobileTerminal } from "@/components/mobile/MobileTerminal";

export default function TerminalPage() {
    return (
        <>
            <div className="hidden md:block">
                <DesktopTerminal />
            </div>
            <div className="block md:hidden">
                <MobileTerminal />
            </div>
        </>
    );
}
