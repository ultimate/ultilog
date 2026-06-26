import Link from "next/link";
import { AuthForm } from "../components/AuthForm";

export default function RegisterPage() {
  return <AuthForm mode="register" footer={<p>Already registered? <Link href="/login">Log in</Link></p>} />;
}
