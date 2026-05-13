import type { Request, Response } from "express";
import { listUsers, upsertInvitedUser } from "../../services/auth.service.js";
import { sendUserInviteEmail } from "../../services/inviteEmail.service.js";
import { signInviteSetPasswordToken } from "../../utils/jwt.js";
import type { InviteUserInput } from "../../validators/users.validators.js";

export async function listUsersHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const users = await listUsers();
  res.status(200).json({ users });
}

export async function inviteUserHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { email } = req.body as InviteUserInput;
  const inviter = req.user!;
  const { userId } = await upsertInvitedUser(email);
  const inviteToken = signInviteSetPasswordToken({ sub: userId, email });
  await sendUserInviteEmail({
    to: email,
    invitedByEmail: inviter.email,
    invitedByUsername: inviter.username,
    inviteToken,
  });

  res.status(200).json({ ok: true, message: "Invitation email sent." });
}
