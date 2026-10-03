import { Type } from 'typebox';

export const Credentials = Type.Object({
  email: Type.String({ format: 'email', minLength: 3, maxLength: 254 }),
  password: Type.String({ minLength: 12, maxLength: 128 }),
});
export const CurrentUser = Type.Object({ id: Type.String(), email: Type.String() });
