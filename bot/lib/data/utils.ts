import Papa from "papaparse";

export const loadFile = async (fileUrl: URL | string): Promise<string> => {
  if (typeof window !== "undefined") {
    const response = await fetch(fileUrl);
    return await response.text();
  } else {
    const fs = await import("node:fs");
    if (!fs || !fs.readFileSync) {
      throw new Error("fs module not available");
    }
    return fs.readFileSync(fileUrl, "utf8");
  }
};

export const parseCsv = <T>(csvData: string): T[] => {
  const result = Papa.parse<T>(csvData, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
};
