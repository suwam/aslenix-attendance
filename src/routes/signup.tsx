import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({ component: SignupPage });

const DEPARTMENTS = ["Development", "UI/UX", "AI/ML", "HR", "Marketing", "Management"];

function SignupPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", confirm: "",
    phone: "", department: "", position: "", address: "",
  });
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    if (form.password !== form.confirm) return toast.error("Passwords don't match");

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: form.full_name,
          phone: form.phone,
          department: form.department,
          position: form.position,
          address: form.address,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — awaiting admin approval");
    nav({ to: "/pending" });
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join ASLENIX — your account will be reviewed by an admin"
      footer={<>Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Full name *</Label>
            <Input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Email *</Label>
            <Input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input type="password" required minLength={6} value={form.password} onChange={(e) => update("password", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Confirm *</Label>
            <Input type="password" required value={form.confirm} onChange={(e) => update("confirm", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={form.department} onValueChange={(v) => update("department", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Position</Label>
            <Input value={form.position} onChange={(e) => update("position", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={loading} className="w-full neon-button rounded-xl h-11 font-medium">
          {loading ? <Loader2 className="animate-spin" size={18} /> : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
