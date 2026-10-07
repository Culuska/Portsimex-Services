import Link from "next/link";

export default function UsersTabs({ active }: { active: "users" | "roles" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`rounded-md px-3 py-1.5 text-sm ${on ? "bg-brand-600 text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
      {label}
    </Link>
  );
  return (
    <div className="mb-4 flex gap-1">
      {tab("/users", "Users", active === "users")}
      {tab("/users/roles", "Roles & permissions", active === "roles")}
    </div>
  );
}
