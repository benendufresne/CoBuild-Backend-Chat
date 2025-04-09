"use strict";

import { BaseDao } from "@modules/baseDao/BaseDao";
import { STATUS, DB_MODEL_REF } from "@config/constant";


export class AdminDao extends BaseDao {
  private adminModel: any;
  constructor() {
    super();
    this.adminModel = DB_MODEL_REF.ADMIN;
  }


  /**
   * @function findUserById
   */
  async findAdminById(userId: string, project = {}) {
    try {
      const query: any = {};
      query._id = userId;
      query.status = { $ne: STATUS.DELETED };

      const projection = Object.values(project).length
        ? project
        : { createdAt: 0, updatedAt: 0 };

      let result = await this.findOne(this.adminModel, query, projection);
      result.userId = result._id;
      return result;
    } catch (error) {
      throw error;
    }
  }

  
}

export const adminDao = new AdminDao();
