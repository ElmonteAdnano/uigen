import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    test("isLoading starts as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    test("sets isLoading to true during execution and false after", async () => {
      let resolveAction!: (v: any) => void;
      (signInAction as any).mockReturnValue(
        new Promise((res) => { resolveAction = res; })
      );
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "new-1" });

      const { result } = renderHook(() => useAuth());

      let signInPromise: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn("a@b.com", "pass");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveAction({ success: true });
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from signInAction", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "bad creds" });
      (getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("a@b.com", "wrong");
      });

      expect(returnValue).toEqual({ success: false, error: "bad creds" });
    });

    test("does not call handlePostSignIn when sign-in fails", async () => {
      (signInAction as any).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "bad");
      });

      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading to false even when signInAction throws", async () => {
      (signInAction as any).mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    test("sets isLoading to true during execution and false after", async () => {
      let resolveAction!: (v: any) => void;
      (signUpAction as any).mockReturnValue(
        new Promise((res) => { resolveAction = res; })
      );
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "new-2" });

      const { result } = renderHook(() => useAuth());

      let signUpPromise: Promise<any>;
      act(() => {
        signUpPromise = result.current.signUp("a@b.com", "pass");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveAction({ success: true });
        await signUpPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from signUpAction", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "email taken" });
      (getAnonWorkData as any).mockReturnValue(null);

      const { result } = renderHook(() => useAuth());

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("a@b.com", "pass");
      });

      expect(returnValue).toEqual({ success: false, error: "email taken" });
    });

    test("does not call handlePostSignIn when sign-up fails", async () => {
      (signUpAction as any).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("a@b.com", "pass");
      });

      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    test("sets isLoading to false even when signUpAction throws", async () => {
      (signUpAction as any).mockRejectedValue(new Error("network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("a@b.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("handlePostSignIn — anon work exists", () => {
    test("creates a project with anon work and redirects to it", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "hello" }],
        fileSystemData: { "/App.jsx": "export default () => <div />" },
      };
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(anonWork);
      (createProject as any).mockResolvedValue({ id: "anon-project-1" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(clearAnonWork).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith("/anon-project-1");
      expect(getProjects).not.toHaveBeenCalled();
    });

    test("does not migrate anon work when messages array is empty", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue({ messages: [], fileSystemData: {} });
      (getProjects as any).mockResolvedValue([{ id: "existing-1" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      expect(clearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-1");
    });
  });

  describe("handlePostSignIn — no anon work", () => {
    test("redirects to the most recent existing project", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([
        { id: "proj-latest" },
        { id: "proj-older" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-latest");
      expect(createProject).not.toHaveBeenCalled();
    });

    test("creates a new project when the user has no existing projects", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "brand-new" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/brand-new");
    });

    test("new project name matches expected format", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "x" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@b.com", "pass");
      });

      const [callArgs] = (createProject as any).mock.calls;
      expect(callArgs[0].name).toMatch(/^New Design #\d+$/);
    });
  });
});
