import { beforeEach,describe,expect,it } from "vitest";
import { sendPasswordReset } from "@/lib/mail";
import { clearMemoryMessages,getMemoryMessages } from "@/lib/mail/memory";

describe("password reset mail",()=>{
  beforeEach(()=>clearMemoryMessages());
  it("stores the one-time link in the test sink without writing it to application logs",async()=>{
    await sendPasswordReset("reader@example.com","http://127.0.0.1:4000/reset-password?token=one-time-token");
    expect(getMemoryMessages()).toEqual([expect.objectContaining({
      to:"reader@example.com",
      subject:"Reset your Bookmark Manager password",
      text:expect.stringContaining("token=one-time-token"),
    })]);
  });
});
