export function parsePagination(input: { page?: string | string[]; pageSize?: string | string[] }) {
  const page = Math.max(1, Number(Array.isArray(input.page) ? input.page[0] : input.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(Array.isArray(input.pageSize) ? input.pageSize[0] : input.pageSize) || 20)
  );
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}
