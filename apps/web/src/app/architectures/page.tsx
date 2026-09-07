"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useArchitectures, useCreateArchitecture, useDeleteArchitecture } from "@/lib/use-architectures";

const EMPTY_GRAPH = { nodes: [], edges: [] };

export default function ArchitecturesPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { data: architectures, isLoading, error } = useArchitectures();
  const createArchitecture = useCreateArchitecture();
  const deleteArchitecture = useDeleteArchitecture();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim() === "") return;
    createArchitecture.mutate(
      { name, graph: EMPTY_GRAPH },
      {
        onSuccess: (created) => {
          setName("");
          router.push(`/architectures/${created.id}`);
        },
      },
    );
  };

  const errorMessage =
    error?.message ?? createArchitecture.error?.message ?? deleteArchitecture.error?.message ?? null;

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">내 아키텍처</h1>

      <form onSubmit={handleSubmit} className="my-4 flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="아키텍처 이름"
          className="flex-1 rounded border border-gray-300 px-3 py-2"
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          만들기
        </button>
      </form>

      {errorMessage && <p className="text-red-600">{errorMessage}</p>}

      {isLoading ? (
        <p>불러오는 중...</p>
      ) : architectures && architectures.length === 0 ? (
        <p className="text-gray-500">아직 만든 아키텍처가 없어요.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {architectures?.map((architecture) => (
            <li key={architecture.id} className="flex items-center justify-between py-2">
              <Link href={`/architectures/${architecture.id}`} className="hover:underline">
                {architecture.name}
              </Link>
              <button
                type="button"
                onClick={() => deleteArchitecture.mutate(architecture.id)}
                className="text-sm text-red-600 hover:underline"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
