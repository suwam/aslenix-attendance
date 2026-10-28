import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { DEPARTMENTS, DEPARTMENT_POSITIONS } from "@/lib/departments";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
    phone: "",
    department: "",
    position: "",
    address: "",
  });
  const [isCustomPosition, setIsCustomPosition] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const availablePositions = form.department ? DEPARTMENT_POSITIONS[form.department] || [] : [];

  const handleDepartmentChange = (dept: string) => {
    update("department", dept);
    setIsCustomPosition(false);
    const newPositions = DEPARTMENT_POSITIONS[dept] || [];
    // Reset position if previous position doesn't fit the new department
    if (!newPositions.includes(form.position)) {
      update("position", "");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.department) return toast.error("Please select a department");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    if (form.password !== form.confirm) return toast.error("Passwords don't match");

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
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
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Full name *</Label>
            <Input
              required
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Email *</Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm *</Label>
            <Input
              type="password"
              required
              value={form.confirm}
              onChange={(e) => update("confirm", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Department *</Label>
            <Select value={form.department} onValueChange={handleDepartmentChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Position</Label>
              {availablePositions.length > 0 && isCustomPosition && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomPosition(false);
                    update("position", availablePositions[0] || "");
                  }}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  Choose from list
                </button>
              )}
            </div>

            {availablePositions.length > 0 && !isCustomPosition ? (
              <Select
                value={
                  availablePositions.includes(form.position)
                    ? form.position
                    : form.position
                      ? "other"
                      : ""
                }
                onValueChange={(v) => {
                  if (v === "other") {
                    setIsCustomPosition(true);
                    update("position", "");
                  } else {
                    update("position", v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      form.department === "Frontend"
                        ? "Select position (e.g. UI/UX Designer)"
                        : "Select position"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availablePositions.map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      {pos}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Other (Type custom position...)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-1.5">
                <Input
                  placeholder={
                    form.department === "Frontend"
                      ? "e.g. UI/UX Designer, Frontend Developer"
                      : "e.g. Software Engineer, Specialist"
                  }
                  value={form.position}
                  onChange={(e) => update("position", e.target.value)}
                />
                {availablePositions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    <span>Common for {form.department}:</span>
                    {availablePositions.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          update("position", p);
                          setIsCustomPosition(false);
                        }}
                        className="rounded-full bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full neon-button rounded-xl h-11 font-medium"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
