export type PasswordResetEmail = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(message: PasswordResetEmail) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`Password reset link for ${message.to}: ${message.resetUrl}`);
  }
}
