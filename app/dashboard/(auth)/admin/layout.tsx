import React from "react";
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  if (!user || !isAdmin) {
    notFound();
  }

  return <>{children}</>;
}

