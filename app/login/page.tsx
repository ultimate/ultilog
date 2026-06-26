import Link from "next/link";
import { AuthForm } from "../components/AuthForm";

export default function LoginPage() {
  return <AuthForm mode="login" footer={<p>Need an account? <Link href="/register">Register</Link></p>} />;
}
