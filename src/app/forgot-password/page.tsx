import AuthCard from "@/components/AuthCard";
import { emailConfigured } from "@/lib/email";
import ForgotForm from "./ForgotForm";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?">
      <ForgotForm emailOn={emailConfigured()} />
    </AuthCard>
  );
}
