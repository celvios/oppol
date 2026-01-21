import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const file: File | null = data.get("file") as unknown as File;

        if (!file) {
            return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create unique filename
        const uniqueParams = uuidv4();
        const extension = file.name.split('.').pop() || 'png';
        const filename = `${uniqueParams}.${extension}`;

        // Save to public/uploads
        const path = join(process.cwd(), "public/uploads", filename);
        await writeFile(path, buffer);

        // Return public URL
        const url = `/uploads/${filename}`;

        return NextResponse.json({ success: true, url });
    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
