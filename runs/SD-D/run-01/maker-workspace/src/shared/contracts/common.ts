import { Type } from 'typebox';

export const Id = Type.String({ minLength: 1 });
export const Timestamp = Type.String({ format: 'date-time' });
export const ApiError = Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String(), field: Type.Optional(Type.String()) }) });
export const Health = Type.Object({ status: Type.Literal('ready') });
