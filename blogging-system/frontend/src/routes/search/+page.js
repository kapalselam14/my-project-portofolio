/** @type {import('./types').PageLoad} */
export async function load({url}){
  const query = url.searchParams.get('q') || '';
  const authorId = url.searchParams.get('authorId');

  const trimmedQuery = query.trim();

  return{
    query: trimmedQuery,
    authorId: authorId || null,
    error: trimmedQuery.length === 1? 'Please enter at least 2 characters to search' : null
  };
}