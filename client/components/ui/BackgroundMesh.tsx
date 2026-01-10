"use client";

import { useEffect, useRef } from "react";

export default function BackgroundMesh() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        // Resize handler
        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener("resize", handleResize);
        handleResize();

        // Particles/Orbs
        const orbs = [
            { x: width * 0.2, y: height * 0.3, r: 400, color: "rgba(0, 240, 255, 0.03)", vx: 0.2, vy: 0.1 }, // Cyan
            { x: width * 0.8, y: height * 0.7, r: 500, color: "rgba(255, 46, 99, 0.03)", vx: -0.2, vy: -0.1 }, // Coral
            { x: width * 0.5, y: height * 0.5, r: 600, color: "rgba(5, 5, 10, 0.5)", vx: 0, vy: 0 }, // Void center
        ];

        let animationFrameId: number;

        const render = () => {
            ctx.fillStyle = "#05050A";
            ctx.fillRect(0, 0, width, height);

            // Update and draw orbs
            orbs.forEach((orb) => {
                orb.x += orb.vx;
                orb.y += orb.vy;

                // Bounce off edges (softly)
                if (orb.x < -100 || orb.x > width + 100) orb.vx *= -1;
                if (orb.y < -100 || orb.y > height + 100) orb.vy *= -1;

                const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
                gradient.addColorStop(0, orb.color);
                gradient.addColorStop(1, "rgba(0,0,0,0)");

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
                ctx.fill();
            });

            // Noise overlay via simple pixel manipulation (optional, skipping for perf in V1)

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-[-1] pointer-events-none"
            style={{ filter: "blur(60px)" }} // Extra blur for nebula feel
        />
    );
}
