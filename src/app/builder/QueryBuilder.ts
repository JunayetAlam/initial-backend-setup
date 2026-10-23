// Query Builder in Prisma

import httpStatus from 'http-status';
import AppError from '../errors/AppError';

type ExtractSelect<T> = T extends { findMany(args: { select: infer S }): any }
  ? S
  : never;

type ExtractInclude<T> = T extends { findMany(args: { include: infer I }): any }
  ? I
  : never;

class QueryBuilder<
  ModelDelegate extends { findMany: Function; count: Function },
> {
  private model: ModelDelegate;
  private query: Record<string, unknown>;
  private prismaQuery: any = {};
  private primaryKeyField: string = 'id';

  constructor(
    model: ModelDelegate,
    query: Record<string, unknown>,
    fieldsWithType: Record<string, 'number' | 'boolean' | 'string'> = {},
  ) {
    if (fieldsWithType && Object.entries(fieldsWithType).length > 0) {
      Object.entries(fieldsWithType).forEach(([field, type]) => {
        if (query[field]) {
          if (type === 'number') {
            query[field] = Number(query[field]);
          } else if (type === 'boolean') {
            if (query[field] === 'true') {
              query[field] = true;
            } else if (query[field] === 'false') {
              query[field] = false;
            } else {
              delete query[field];
            }
          } else if (type === 'string') {
            query[field] = String(query[field]);
          }
        }
      });
    }

    this.model = model;
    this.query = query;
  }

  // Search
  search(searchableFields: string[]) {
    const searchTerm = this.query.searchTerm as string;
    if (searchTerm) {
      this.prismaQuery.where = {
        ...this.prismaQuery.where,
        OR: searchableFields.map(field => {
          if (field.includes('.')) {
            const [parentField, childField, grandChildField] = field.split('.');
            if (!grandChildField) {
              return {
                [parentField]: {
                  [childField]: { contains: searchTerm, mode: 'insensitive' },
                },
              };
            } else {
              // A to-many parent (e.g. `filterTypeFilters`) needs `some`
              const parentIsPlural = parentField.endsWith('s');
              if (parentIsPlural) {
                return {
                  [parentField]: {
                    some: {
                      [childField]: {
                        [grandChildField]: {
                          contains: searchTerm,
                          mode: 'insensitive',
                        },
                      },
                    },
                  },
                };
              } else {
                return {
                  [parentField]: {
                    [childField]: {
                      [grandChildField]: {
                        contains: searchTerm,
                        mode: 'insensitive',
                      },
                    },
                  },
                };
              }
            }
          }
          return { [field]: { contains: searchTerm, mode: 'insensitive' } };
        }),
      };
    }
    return this;
  }

  // Filter
  filter() {
    const queryObj = { ...this.query };
    const excludeFields = [
      'searchTerm',
      'sort',
      'limit',
      'page',
      'fields',
      'exclude',
    ];
    excludeFields.forEach(field => delete queryObj[field]);

    const formattedFilters: Record<string, unknown> = {};

    const setNestedObject = (
      obj: Record<string, any>,
      path: string,
      value: unknown,
    ) => {
      const keys = path.split('.');
      let current = obj;
      keys.forEach((key, index) => {
        if (index === keys.length - 1) {
          current[key] = value;
        } else {
          if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
          }
          current = current[key];
        }
      });
    };

    for (const [key, value] of Object.entries(queryObj)) {
      setNestedObject(formattedFilters, key, value);
    }

    this.prismaQuery.where = {
      ...this.prismaQuery.where,
      ...formattedFilters,
    };

    return this;
  }

  // Sorting
  sort() {
    const sort = (this.query.sort as string)?.split(',') || ['-createdAt'];
    this.prismaQuery.orderBy = sort.map(field =>
      field.startsWith('-') ? { [field.slice(1)]: 'desc' } : { [field]: 'asc' },
    );
    return this;
  }

  // Pagination
  paginate() {
    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;
    const skip = (page - 1) * limit;

    this.prismaQuery.skip = skip;
    this.prismaQuery.take = limit;

    return this;
  }

  // Fields Selection
  fields() {
    const fieldsParam = this.query.fields as string;
    if (fieldsParam) {
      const fields = fieldsParam
        .split(',')
        .filter(field => field.trim() !== '');

      if (fields.length > 0) {
        this.prismaQuery.select = {};
        fields.forEach(field => {
          const trimmedField = field.trim();
          if (trimmedField.startsWith('-')) {
            this.prismaQuery.select[trimmedField.slice(1)] = false;
          } else {
            this.prismaQuery.select[trimmedField] = true;
          }
        });

        const hasAtLeastOneTrueField = Object.values(
          this.prismaQuery.select,
        ).some(value => value === true);
        if (!hasAtLeastOneTrueField) {
          this.prismaQuery.select[this.primaryKeyField] = true;
        }
      }
    }
    return this;
  }

  select(data: ExtractSelect<ModelDelegate>) {
    if (data) {
      this.prismaQuery.select = data;
    }
    return this;
  }

  include(data: ExtractInclude<ModelDelegate>) {
    if (data) {
      this.prismaQuery.include = data;
    }
    return this;
  }

  // Exclude Fields
  exclude() {
    const excludeParam = this.query.exclude as string;
    if (excludeParam) {
      const excludeFields = excludeParam
        .split(',')
        .filter(field => field.trim() !== '');

      if (!this.prismaQuery.select) {
        this.prismaQuery.select = {};
      }

      excludeFields.forEach(field => {
        this.prismaQuery.select[field.trim()] = false;
      });

      const hasAtLeastOneTrueField = Object.values(
        this.prismaQuery.select,
      ).some(value => value === true);
      if (!hasAtLeastOneTrueField) {
        this.prismaQuery.select[this.primaryKeyField] = true;
      }
    }
    return this;
  }

  // Execute Query
  async execute() {
    if (this.prismaQuery.select) {
      if (Object.keys(this.prismaQuery.select).length === 0) {
        delete this.prismaQuery.select;
      }

      if (this.query.fields) {
        const hasAtLeastOneTrueField = Object.values(
          this.prismaQuery.select,
        ).some(value => value === true);
        if (!hasAtLeastOneTrueField) {
          this.prismaQuery.select[this.primaryKeyField] = true;
        }
      }
    }

    // Run findMany and count in parallel
    const [results, total] = await Promise.all([
      this.model.findMany(this.prismaQuery),
      this.model.count({ where: this.prismaQuery.where }),
    ]);

    // Handle removing primary key from results if requested
    let processedResults = results;
    if (this.query.fields && results.length > 0) {
      const fieldsRequested = (this.query.fields as string)
        .split(',')
        .map(f => f.trim());
      if (!fieldsRequested.includes(this.primaryKeyField)) {
        processedResults = results.map((item: Record<string, unknown>) => {
          const newItem = { ...item };
          delete newItem[this.primaryKeyField];
          return newItem;
        });
      }
    }

    const page = Number(this.query.page) || 1;
    const limit = Number(this.query.limit) || 10;

    return {
      data: processedResults,
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
    };
  }
}

export default QueryBuilder;
