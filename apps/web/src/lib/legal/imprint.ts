import "server-only";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  email: z.string().trim().pipe(z.email()),
});

export function getImprint() {
  const result = schema.safeParse({
    name: process.env.IMPRESSUM_NAME,
    address: process.env.IMPRESSUM_ADDRESS,
    email: process.env.IMPRESSUM_EMAIL,
  });
  return result.success ? result.data : null;
}
