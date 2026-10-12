import { Model, PopulateOptions } from 'mongoose';
import { PaginationQueryDto, PaginatedResponse } from '../dto/pagination.dto';

export async function paginate<T>(
  model: Model<any>,
  filter: Record<string, any> = {},
  paginationDto: PaginationQueryDto = {},
  populateOptions?: PopulateOptions | (PopulateOptions | string)[],
): Promise<PaginatedResponse<T>> {
  const page = Math.max(1, Number(paginationDto.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(paginationDto.limit) || 20));
  const skip = (page - 1) * limit;

  const sortBy = paginationDto.sortBy || 'createdAt';
  const sortOrder = paginationDto.sortOrder === 'asc' ? 1 : -1;
  const sort: Record<string, any> = { [sortBy]: sortOrder };

  const [total, items] = await Promise.all([
    model.countDocuments(filter),
    (async () => {
      let query = model.find(filter).sort(sort).skip(skip).limit(limit);
      if (populateOptions) {
        if (Array.isArray(populateOptions)) {
          for (const opt of populateOptions) {
            query = query.populate(opt as any);
          }
        } else {
          query = query.populate(populateOptions);
        }
      }
      return query.lean().exec();
    })(),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data: items as T[],
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
